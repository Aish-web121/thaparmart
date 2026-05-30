package Thapar.Marketing.place.Marketing_Project.Services;

import Thapar.Marketing.place.Marketing_Project.Entities.Product;
import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.Repositories.ProductRepository;
import Thapar.Marketing.place.Marketing_Project.dtos.request.ProductRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.response.ProductResponse;
import Thapar.Marketing.place.Marketing_Project.enums.Category;
import Thapar.Marketing.place.Marketing_Project.enums.ProductStatus;
import Thapar.Marketing.place.Marketing_Project.exceptions.ResourceNotFoundException;
import Thapar.Marketing.place.Marketing_Project.exceptions.UnauthorizedException;
import Thapar.Marketing.place.Marketing_Project.filter.KeywordFilter;
import Thapar.Marketing.place.Marketing_Project.filter.ProductSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final KeywordFilter keywordFilter;

    // ── Create listing ────────────────────────────────────────────
    public ProductResponse createProduct(ProductRequest request, User seller) {

        // 1. scan for banned keywords
        keywordFilter.validate(request.getTitle(), request.getDescription());

        // 2. build product
        Product product = Product.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .price(request.getPrice())
                .category(request.getCategory())
                .imageUrl(request.getImageUrl())
                .seller(seller)
                .status(ProductStatus.PENDING_REVIEW)  // always pending first
                .reportCount(0)
                .build();

        // OTHER category always needs manual review
        productRepository.save(product);
        return mapToResponse(product);
    }

    // ── Get all available products ────────────────────────────────
    public List<ProductResponse> getAllAvailable() {
        return productRepository.findByStatus(ProductStatus.AVAILABLE)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ── Get single product ────────────────────────────────────────
    public ProductResponse getById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found with id: " + id));
        return mapToResponse(product);
    }

    // ── Search with filters ───────────────────────────────────────
    public List<ProductResponse> search(
            String query, Category category,
            Double minPrice, Double maxPrice) {

        Specification<Product> spec =
                ProductSpecification.filter(query, category, minPrice, maxPrice);

        return productRepository.findAll(spec)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ── My listings (seller) ──────────────────────────────────────
    public List<ProductResponse> getMyListings(User seller) {
        return productRepository.findBySeller(seller)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ── Edit listing ──────────────────────────────────────────────
    public ProductResponse updateProduct(Long id, ProductRequest request, User seller) {

        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found with id: " + id));

        // only owner or admin can edit
        if (!product.getSeller().getId().equals(seller.getId())) {
            throw new UnauthorizedException(
                    "You can only edit your own listings");
        }

        // re-scan keywords on edit
        keywordFilter.validate(request.getTitle(), request.getDescription());

        product.setTitle(request.getTitle());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setCategory(request.getCategory());
        product.setImageUrl(request.getImageUrl());
        // edited listing goes back to pending review
        product.setStatus(ProductStatus.PENDING_REVIEW);

        productRepository.save(product);
        return mapToResponse(product);
    }

    // ── Update status (SOLD / ARCHIVED) ──────────────────────────
    public ProductResponse updateStatus(Long id, ProductStatus newStatus, User seller) {

        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found with id: " + id));

        if (!product.getSeller().getId().equals(seller.getId())) {
            throw new UnauthorizedException(
                    "You can only update status of your own listings");
        }

        product.setStatus(newStatus);
        productRepository.save(product);
        return mapToResponse(product);
    }

    // ── Delete listing ────────────────────────────────────────────
    public void deleteProduct(Long id, User seller) {

        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found with id: " + id));

        if (!product.getSeller().getId().equals(seller.getId())) {
            throw new UnauthorizedException(
                    "You can only delete your own listings");
        }

        productRepository.delete(product);
    }

    // ── Map entity to response ────────────────────────────────────
    public ProductResponse mapToResponse(Product product) {
        return ProductResponse.builder()
                .id(product.getId())
                .title(product.getTitle())
                .description(product.getDescription())
                .price(product.getPrice())
                .category(product.getCategory())
                .status(product.getStatus())
                .imageUrl(product.getImageUrl())
                .rejectionReason(product.getRejectionReason())
                .reportCount(product.getReportCount())
                // seller info
                .sellerId(product.getSeller().getId())
                .sellerName(product.getSeller().getName())
                // meeting point auto from seller hostel
                .meetingHostel(product.getSeller().getHostelName())
                .meetingRoom(product.getSeller().getHostelRoom())
                .createdAt(product.getCreatedAt())
                .build();
    }
}