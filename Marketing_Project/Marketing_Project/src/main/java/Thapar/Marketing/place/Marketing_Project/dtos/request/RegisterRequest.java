package Thapar.Marketing.place.Marketing_Project.dtos.request;
import Thapar.Marketing.place.Marketing_Project.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
@Data
public class RegisterRequest {
    @NotBlank(message = "Name is required")
    private String name;
    @NotBlank(message = "Email is required")
    @Email(message = "Must be a valid email")
    private String email;
    @NotBlank(message = "Password is required")
    private String password;
    // Role defaults to SELLER; ADMIN cannot be set via registration
    private Role role = Role.SELLER;
    private String college;
    private String hostelName;
    private String hostelRoom;
}
