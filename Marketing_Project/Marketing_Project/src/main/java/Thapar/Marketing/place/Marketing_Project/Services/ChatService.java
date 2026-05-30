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

import java.util.List;
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

        // push message to receiver in real time
        // receiver listens on /topic/messages/{receiverId}
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