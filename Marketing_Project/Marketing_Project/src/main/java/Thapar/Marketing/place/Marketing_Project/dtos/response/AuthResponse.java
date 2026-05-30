package Thapar.Marketing.place.Marketing_Project.dtos.response;



import Thapar.Marketing.place.Marketing_Project.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String name;
    private String email;
    private Role role;
}
