package Thapar.Marketing.place.Marketing_Project.Controllers;

import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.Services.AuthService;
import Thapar.Marketing.place.Marketing_Project.dtos.request.LoginRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.request.RegisterRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.request.ResendVerificationRequest;  // NEW
import Thapar.Marketing.place.Marketing_Project.dtos.request.VerifyEmailRequest;          // NEW
import Thapar.Marketing.place.Marketing_Project.dtos.response.AuthResponse;
import Thapar.Marketing.place.Marketing_Project.dtos.response.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;                                                // NEW
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;                                                                     // NEW

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // POST /api/auth/register
    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(
            @Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ResponseEntity
                .status(HttpStatus.ACCEPTED)
                .body(Map.of("message",
                        "Registration successful. Please check your @thapar.edu inbox for the verification code."));
    }

    // POST /api/auth/verify-email  — NEW
    @PostMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request);
        return ResponseEntity.ok(Map.of("message",
                "Email verified successfully. You can now sign in."));
    }

    // POST /api/auth/resend-verification  — NEW
    @PostMapping("/resend-verification")
    public ResponseEntity<Map<String, String>> resendVerification(
            @Valid @RequestBody ResendVerificationRequest request) {
        authService.resendVerification(request.getEmail());
        return ResponseEntity.ok(Map.of("message",
                "A new verification code has been sent."));
    }

    // POST /api/auth/login
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/test-hash") // temporary
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
