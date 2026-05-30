package Thapar.Marketing.place.Marketing_Project.dtos.response;


import Thapar.Marketing.place.Marketing_Project.enums.Role;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserResponse {
    private Long id;
    private String name;
    private String email;
    private Role role;
    private String college;
    private String hostelName;   // shown as meeting point to buyers
    private String hostelRoom;
    private boolean banned;
}
