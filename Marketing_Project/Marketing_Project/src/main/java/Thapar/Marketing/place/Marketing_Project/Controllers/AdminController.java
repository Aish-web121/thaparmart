package Thapar.Marketing.place.Marketing_Project.Controllers;

import Thapar.Marketing.place.Marketing_Project.Services.AdminService;
import Thapar.Marketing.place.Marketing_Project.dtos.request.RejectRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.response.ProductResponse;
import Thapar.Marketing.place.Marketing_Project.dtos.response.ReportResponse;
import Thapar.Marketing.place.Marketing_Project.dtos.response.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAuthority('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // ── Products ──────────────────────────────────────────────────

    @GetMapping("/products/pending")
    public ResponseEntity<List<ProductResponse>> getPendingProducts() {
        return ResponseEntity.ok(adminService.getPendingProducts());
    }

    @PatchMapping("/products/{id}/approve")
    public ResponseEntity<ProductResponse> approveProduct(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.approveProduct(id));
    }

    @PatchMapping("/products/{id}/reject")
    public ResponseEntity<ProductResponse> rejectProduct(
            @PathVariable Long id,
            @Valid @RequestBody RejectRequest request) {
        return ResponseEntity.ok(adminService.rejectProduct(id, request.getReason()));
    }

    @PatchMapping("/products/{id}/hide")
    public ResponseEntity<ProductResponse> hideProduct(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.hideProduct(id));
    }

    @PatchMapping("/products/{id}/unhide")
    public ResponseEntity<ProductResponse> unhideProduct(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.unhideProduct(id));
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<String> deleteProduct(@PathVariable Long id) {
        adminService.deleteProduct(id);
        return ResponseEntity.ok("Product deleted by admin");
    }

    // ── Reports ───────────────────────────────────────────────────

    @GetMapping("/reports")
    public ResponseEntity<List<ReportResponse>> getAllReports() {
        return ResponseEntity.ok(adminService.getAllReports());
    }

    @PatchMapping("/reports/{id}/resolve")
    public ResponseEntity<ReportResponse> resolveReport(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.resolveReport(id));
    }

    // ── Users ─────────────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @PatchMapping("/users/{id}/ban")
    public ResponseEntity<UserResponse> banUser(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.banUser(id));
    }

    @PatchMapping("/users/{id}/unban")
    public ResponseEntity<UserResponse> unbanUser(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.unbanUser(id));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<String> deleteUser(@PathVariable Long id) {
        adminService.deleteUser(id);
        return ResponseEntity.ok("User deleted by admin");
    }

    // ── Keywords ──────────────────────────────────────────────────

    @GetMapping("/keywords")
    public ResponseEntity<List<String>> getBannedKeywords() {
        return ResponseEntity.ok(adminService.getBannedKeywords());
    }
}