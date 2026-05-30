package Thapar.Marketing.place.Marketing_Project.Services;

import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.Repositories.UserRepository;
import Thapar.Marketing.place.Marketing_Project.dtos.request.LoginRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.request.RegisterRequest;
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

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    // ── Register ──────────────────────────────────────────────────
    public AuthResponse register(RegisterRequest request) {

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new UserAlreadyExistsException(
                    "Email already registered: " + request.getEmail());
        }

        if (request.getRole() == Role.ADMIN) {
            throw new UnauthorizedException(
                    "Admin accounts cannot be created via registration");
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
                .build();

        userRepository.save(user);
        return buildAuthResponse(user);
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
            throw new UnauthorizedException("Your account has been banned");
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
            throw new UnauthorizedException("Your account has been banned");
        }

        return jwtService.generateAccessToken(user);
    }

    // ── Get Profile ───────────────────────────────────────────────
    public UserResponse getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found"));

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

    // ── Helper ────────────────────────────────────────────────────
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