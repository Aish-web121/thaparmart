package Thapar.Marketing.place.Marketing_Project.Controllers;

import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.Services.ProductService;
import Thapar.Marketing.place.Marketing_Project.dtos.request.ProductRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.response.ProductResponse;
import Thapar.Marketing.place.Marketing_Project.enums.Category;
import Thapar.Marketing.place.Marketing_Project.enums.ProductStatus;
import com.cloudinary.Cloudinary;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final Cloudinary cloudinary;

    // GET /api/products — public
    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAll() {
        return ResponseEntity.ok(productService.getAllAvailable());
    }

    // GET /api/products/{id} — public
    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getById(id));
    }

    // GET /api/products/search
    @GetMapping("/search")
    public ResponseEntity<List<ProductResponse>> search(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Category category,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice) {
        return ResponseEntity.ok(
                productService.search(query, category, minPrice, maxPrice));
    }

    // POST /api/products/upload-image — uploads to Cloudinary
    @PreAuthorize("hasAnyAuthority('SELLER', 'ADMIN')")
    @PostMapping("/upload-image")
    public ResponseEntity<Map<String, String>> uploadImage(
            @RequestParam("file") MultipartFile file) throws IOException {

        Map uploadResult = cloudinary.uploader().upload(
                file.getBytes(),
                Map.of(
                        "folder", "thaparmart",
                        "resource_type", "image"
                )
        );

        String url = (String) uploadResult.get("secure_url");
        return ResponseEntity.ok(Map.of("url", url));
    }

    // GET /api/products/my — SELLER only
    @GetMapping("/my")
    @PreAuthorize("hasAnyAuthority('SELLER', 'ADMIN')")
    public ResponseEntity<List<ProductResponse>> getMyListings(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(productService.getMyListings(user));
    }

    // POST /api/products — SELLER only
    @PostMapping
    @PreAuthorize("hasAnyAuthority('SELLER', 'ADMIN')")
    public ResponseEntity<ProductResponse> create(
            @Valid @RequestBody ProductRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(productService.createProduct(request, user));
    }

    // PUT /api/products/{id}
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('SELLER', 'ADMIN')")
    public ResponseEntity<ProductResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody ProductRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(productService.updateProduct(id, request, user));
    }

    // PATCH /api/products/{id}/status
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyAuthority('SELLER', 'ADMIN')")
    public ResponseEntity<ProductResponse> updateStatus(
            @PathVariable Long id,
            @RequestParam ProductStatus status,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(productService.updateStatus(id, status, user));
    }

    // DELETE /api/products/{id}
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('SELLER', 'ADMIN')")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        productService.deleteProduct(id, user);
        return ResponseEntity.noContent().build();
    }
}