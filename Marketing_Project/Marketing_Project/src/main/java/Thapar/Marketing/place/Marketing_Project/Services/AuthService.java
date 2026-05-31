package Thapar.Marketing.place.Marketing_Project.Services;

import Thapar.Marketing.place.Marketing_Project.Entities.EmailVerificationToken;
import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.Repositories.EmailVerificationTokenRepository;
import Thapar.Marketing.place.Marketing_Project.Repositories.UserRepository;
import Thapar.Marketing.place.Marketing_Project.dtos.request.LoginRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.request.RegisterRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.request.VerifyEmailRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.response.AuthResponse;
import Thapar.Marketing.place.Marketing_Project.dtos.response.UserResponse;
import Thapar.Marketing.place.Marketing_Project.enums.Role;
import Thapar.Marketing.place.Marketing_Project.exceptions.ResourceNotFoundException;
import Thapar.Marketing.place.Marketing_Project.exceptions.UnauthorizedException;
import Thapar.Marketing.place.Marketing_Project.exceptions.UserAlreadyExistsException;
import Thapar.Marketing.place.Marketing_Project.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String THAPAR_DOMAIN = "@thapar.edu";
    private static final int OTP_EXPIRY_MINUTES = 10;

    private final UserRepository userRepository;
    private final EmailVerificationTokenRepository tokenRepository; // NEW
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final EmailService emailService; // NEW

    // ── Register ──────────────────────────────────────────────────
    @Transactional
    public void register(RegisterRequest request) {

        // Domain check
        if (!request.getEmail().toLowerCase().endsWith(THAPAR_DOMAIN)) {
            throw new UnauthorizedException(
                    "Only @thapar.edu email addresses are allowed to register.");
        }

        // Already registered?
        if (userRepository.existsByEmail(request.getEmail())) {
            User existing = userRepository.findByEmail(request.getEmail()).get();
            if (!existing.isEmailVerified()) {
                // Unverified — just resend OTP instead of erroring
                issueAndSendOtp(existing.getEmail());
                return;
            }
            throw new UserAlreadyExistsException(
                    "Email already registered: " + request.getEmail());
        }

        if (request.getRole() == Role.ADMIN) {
            throw new UnauthorizedException(
                    "Admin accounts cannot be created via registration.");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .college(request.getCollege())
                .hostelName(request.getHostelName())
                .hostelRoom(request.getHostelRoom())
                .banned(false)
                .emailVerified(false) // NEW
                .build();

        userRepository.save(user);
        issueAndSendOtp(user.getEmail()); // NEW — send OTP after saving
    }

    // ── Verify Email ────────────────────────────────────────────── NEW
    @Transactional
    public void verifyEmail(VerifyEmailRequest request) {

        EmailVerificationToken token = tokenRepository
                .findTopByEmailOrderByCreatedAtDesc(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No verification code found. Please register again."));

        if (token.isUsed()) {
            throw new UnauthorizedException("This code has already been used.");
        }
        if (token.isExpired()) {
            throw new UnauthorizedException("Code expired. Please request a new one.");
        }
        if (!token.getOtp().equals(request.getOtp())) {
            throw new UnauthorizedException("Invalid verification code.");
        }

        token.setUsed(true);
        tokenRepository.save(token);

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User not found."));
        user.setEmailVerified(true);
        userRepository.save(user);
    }

    // ── Resend OTP ──────────────────────────────────────────────── NEW
    @Transactional
    public void resendVerification(String email) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No account found for " + email));

        if (user.isEmailVerified()) {
            throw new UnauthorizedException("Email is already verified.");
        }

        issueAndSendOtp(email);
    }

    // ── Login ─────────────────────────────────────────────────────
    public AuthResponse login(LoginRequest request) {

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(), request.getPassword()
                )
        );

        User user = (User) authentication.getPrincipal();

        if (user.isBanned()) {
            throw new UnauthorizedException("Your account has been banned.");
        }

        return buildAuthResponse(user);
    }

    // ── Refresh Token ─────────────────────────────────────────────
    public String refreshToken(String refreshToken) {
        Long userId = jwtService.getUserIdFromToken(refreshToken);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with id: " + userId));

        if (user.isBanned()) {
            throw new UnauthorizedException("Your account has been banned.");
        }

        return jwtService.generateAccessToken(user);
    }

    // ── Get Profile ───────────────────────────────────────────────
    public UserResponse getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found."));

        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .college(user.getCollege())
                .hostelName(user.getHostelName())
                .hostelRoom(user.getHostelRoom())
                .banned(user.isBanned())
                .build();
    }

    // ── Private Helpers ───────────────────────────────────────────

    private void issueAndSendOtp(String email) {
        tokenRepository.deleteAllByEmail(email);

        String otp = generateOtp();

        EmailVerificationToken token = EmailVerificationToken.builder()
                .email(email)
                .otp(otp)
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .used(false)
                .build();

        tokenRepository.save(token);
        emailService.sendVerificationOtp(email, otp);
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int code = 100_000 + random.nextInt(900_000);
        return String.valueOf(code);
    }

    private AuthResponse buildAuthResponse(User user) {
        return AuthResponse.builder()
                .accessToken(jwtService.generateAccessToken(user))
                .refreshToken(jwtService.generateRefreshToken(user))
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }
}
