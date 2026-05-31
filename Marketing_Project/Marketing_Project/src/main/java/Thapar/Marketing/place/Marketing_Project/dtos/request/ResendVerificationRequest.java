package Thapar.Marketing.place.Marketing_Project.dtos.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResendVerificationRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Must be a valid email")
    private String email;
}
