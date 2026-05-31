package Thapar.Marketing.place.Marketing_Project.Services;

import Thapar.Marketing.place.Marketing_Project.Entities.ChatMessage;
import Thapar.Marketing.place.Marketing_Project.Entities.Product;
import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.Repositories.ChatMessageRepository;
import Thapar.Marketing.place.Marketing_Project.Repositories.ProductRepository;
import Thapar.Marketing.place.Marketing_Project.Repositories.UserRepository;
import Thapar.Marketing.place.Marketing_Project.dtos.request.SendMessageRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.response.ChatMessageResponse;
import Thapar.Marketing.place.Marketing_Project.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // ── Send a message ────────────────────────────────────────────
    public ChatMessageResponse sendMessage(SendMessageRequest request, Long senderId) {

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        User receiver = userRepository.findById(request.getReceiverId())
                .orElseThrow(() -> new ResourceNotFoundException("Receiver not found"));

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        ChatMessage message = ChatMessage.builder()
                .sender(sender)
                .receiver(receiver)
                .product(product)
                .content(request.getContent())
                .read(false)
                .build();

        chatMessageRepository.save(message);

        ChatMessageResponse response = mapToResponse(message);

        // Push new message to receiver in real time
        messagingTemplate.convertAndSend(
                "/topic/messages/" + receiver.getId(), response
        );

        return response;
    }

    // ── Get conversation ──────────────────────────────────────────
    public List<ChatMessageResponse> getConversation(
            Long productId, Long userId1, Long userId2) {

        return chatMessageRepository
                .findConversation(productId, userId1, userId2)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ── Get inbox ─────────────────────────────────────────────────
    public List<ChatMessageResponse> getInbox(Long userId) {
        return chatMessageRepository
                .findAllByUser(userId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ── Mark messages as read ─────────────────────────────────────
    // Called when receiver opens a thread.
    // Marks all unread messages in this conversation as read,
    // then notifies the original sender via WebSocket so their
    // grey ticks turn blue instantly.
    @Transactional
    public void markAsRead(Long productId, Long readerId, Long otherUserId) {

        List<ChatMessage> unread = chatMessageRepository
                .findConversation(productId, readerId, otherUserId)
                .stream()
                .filter(m -> m.getReceiver().getId().equals(readerId) && !m.isRead())
                .collect(Collectors.toList());

        if (unread.isEmpty()) return;

        unread.forEach(m -> m.setRead(true));
        chatMessageRepository.saveAll(unread);

        // Notify the sender that their messages have been read.
        // Frontend listens on /topic/read/{senderId}
        // Payload: { productId, readerId } — enough for the frontend
        // to flip ticks blue for that conversation.
        Map<String, Object> receipt = new HashMap<>();
        receipt.put("productId", productId);
        receipt.put("readerId", readerId);

        messagingTemplate.convertAndSend(
                "/topic/read/" + otherUserId, receipt
        );
    }

    // ── Mapper ────────────────────────────────────────────────────
    public ChatMessageResponse mapToResponse(ChatMessage message) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .productId(message.getProduct().getId())
                .productTitle(message.getProduct().getTitle())
                .senderId(message.getSender().getId())
                .senderName(message.getSender().getName())
                .receiverId(message.getReceiver().getId())
                .receiverName(message.getReceiver().getName())
                .content(message.getContent())
                .read(message.isRead())
                .sentAt(message.getSentAt())
                .build();
    }
}
