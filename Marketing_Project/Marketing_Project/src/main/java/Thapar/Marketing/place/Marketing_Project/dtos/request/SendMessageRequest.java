package Thapar.Marketing.place.Marketing_Project.dtos.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SendMessageRequest {

    @NotNull
    private Long productId;

    @NotNull
    private Long receiverId;

    @NotBlank
    private String content;
}