package Thapar.Marketing.place.Marketing_Project.Controllers;

import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.Services.AuthService;
import Thapar.Marketing.place.Marketing_Project.dtos.request.LoginRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.request.RegisterRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.response.AuthResponse;
import Thapar.Marketing.place.Marketing_Project.dtos.response.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // POST /api/auth/register
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    // POST /api/auth/login
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/test-hash")//temporaRY
    public String testHash() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        return encoder.encode("admin123");
    }
    // POST /api/auth/refresh
    @PostMapping("/refresh")
    public ResponseEntity<String> refresh(
            @RequestBody String refreshToken) {
        return ResponseEntity.ok(authService.refreshToken(refreshToken));
    }

    // GET /api/auth/me
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getProfile(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(authService.getProfile(user.getId()));
    }
}