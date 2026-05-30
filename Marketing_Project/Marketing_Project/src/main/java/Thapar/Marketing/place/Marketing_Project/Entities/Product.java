package Thapar.Marketing.place.Marketing_Project.Entities;

import Thapar.Marketing.place.Marketing_Project.enums.Category;
import Thapar.Marketing.place.Marketing_Project.enums.ProductStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "products")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 1000)
    private String description;

    @Column(nullable = false)
    private Double price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductStatus status;

    private String imageUrl;

    // rejection reason set by admin
    private String rejectionReason;

    // auto-incremented when buyers report this product
    @Column(nullable = false)
    private Integer reportCount = 0;

    // seller who created this listing
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id", nullable = false)
    private User seller;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        // new listings always go to PENDING_REVIEW first
        if (this.status == null) {
            this.status = ProductStatus.PENDING_REVIEW;
        }
        // OTHER category always needs extra review
        if (this.reportCount == null) {
            this.reportCount = 0;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}