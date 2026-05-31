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
    // Returns only the latest message per thread.
    public List<ChatMessageResponse> getInbox(Long userId) {
        return chatMessageRepository
                .findAllByUser(userId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ── Get unread counts per thread ──────────────────────────────
    // Returns map of "productId-otherUserId" -> count
    public Map<String, Long> getUnreadCounts(Long userId) {
        List<ChatMessage> allMine = chatMessageRepository.findUnreadReceivedMessages(userId);
        Map<String, Long> result = new HashMap<>();
        for (ChatMessage m : allMine) {
            String key = m.getProduct().getId() + "-" + m.getSender().getId();
            result.merge(key, 1L, Long::sum);
        }
        return result;
    }

    // ── Mark messages as read ─────────────────────────────────────
    // Single bulk UPDATE — no loading all messages into memory.
    // Sends WebSocket receipt to sender only if something changed.
    @Transactional
    public void markAsRead(Long productId, Long readerId, Long otherUserId) {

        int updated = chatMessageRepository.markAllAsRead(productId, readerId, otherUserId);

        if (updated > 0) {
            Map<String, Object> receipt = new HashMap<>();
            receipt.put("productId", productId);
            receipt.put("readerId", readerId);

            // Notify sender — their grey ticks turn blue
            messagingTemplate.convertAndSend(
                    "/topic/read/" + otherUserId, receipt
            );
        }
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
