package Thapar.Marketing.place.Marketing_Project.dtos.response;

import lombok.*;
import java.time.LocalDateTime;

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
    private LocalDateTime sentAt;
}