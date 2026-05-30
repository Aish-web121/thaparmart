package Thapar.Marketing.place.Marketing_Project.dtos.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RejectRequest {

    @NotBlank(message = "Rejection reason is required")
    private String reason;
}