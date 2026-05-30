package Thapar.Marketing.place.Marketing_Project.Services;

import Thapar.Marketing.place.Marketing_Project.Entities.Product;
import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.Repositories.ProductRepository;
import Thapar.Marketing.place.Marketing_Project.Repositories.UserRepository;
import Thapar.Marketing.place.Marketing_Project.dtos.response.ProductResponse;
import Thapar.Marketing.place.Marketing_Project.dtos.response.ReportResponse;
import Thapar.Marketing.place.Marketing_Project.dtos.response.UserResponse;
import Thapar.Marketing.place.Marketing_Project.enums.ProductStatus;
import Thapar.Marketing.place.Marketing_Project.exceptions.ResourceNotFoundException;
import Thapar.Marketing.place.Marketing_Project.filter.KeywordFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final ProductService productService;
    private final ReportService reportService;
    private final KeywordFilter keywordFilter;

    // ── Products ──────────────────────────────────────────────────

    public List<ProductResponse> getPendingProducts() {
        return productRepository
                .findByStatusOrderByCreatedAtAsc(ProductStatus.PENDING_REVIEW)
                .stream()
                .map(productService::mapToResponse)
                .collect(Collectors.toList());
    }

    public ProductResponse approveProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + productId));
        product.setStatus(ProductStatus.AVAILABLE);
        product.setRejectionReason(null);
        productRepository.save(product);
        return productService.mapToResponse(product);
    }

    public ProductResponse rejectProduct(Long productId, String reason) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + productId));
        product.setStatus(ProductStatus.REJECTED);
        product.setRejectionReason(reason);
        productRepository.save(product);
        return productService.mapToResponse(product);
    }

    public ProductResponse hideProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + productId));
        product.setStatus(ProductStatus.PENDING_REVIEW);
        productRepository.save(product);
        return productService.mapToResponse(product);
    }

    public ProductResponse unhideProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + productId));
        product.setStatus(ProductStatus.AVAILABLE);
        productRepository.save(product);
        return productService.mapToResponse(product);
    }

    public void deleteProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + productId));
        productRepository.delete(product);
    }

    // ── Reports (delegated to ReportService) ─────────────────────

    public List<ReportResponse> getAllReports() {
        return reportService.getAllUnresolved();
    }

    public ReportResponse resolveReport(Long reportId) {
        return reportService.resolveReport(reportId);
    }

    // ── Users ─────────────────────────────────────────────────────

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::mapUserToResponse)
                .collect(Collectors.toList());
    }

    public UserResponse banUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        user.setBanned(true);
        userRepository.save(user);
        return mapUserToResponse(user);
    }

    public UserResponse unbanUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        user.setBanned(false);
        userRepository.save(user);
        return mapUserToResponse(user);
    }

    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        userRepository.delete(user);
    }

    // ── Keywords ──────────────────────────────────────────────────

    public List<String> getBannedKeywords() {
        return keywordFilter.getBannedKeywords();
    }

    // ── Mapper ────────────────────────────────────────────────────

    private UserResponse mapUserToResponse(User user) {
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
}