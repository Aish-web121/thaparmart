package Thapar.Marketing.place.Marketing_Project.dtos.response;

import lombok.*;
import java.time.Instant;

@Data
@Builder
public class ChatMessageResponse {
    private Long id;
    private Long productId;
    private String productTitle;
    private Long senderId;
    private String senderName;
    private Long receiverId;
    private String receiverName;
    private String content;
    private boolean read;
    private Instant sentAt;   // serializes as "2025-01-15T11:00:00Z" — always UTC
}
