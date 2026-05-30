package Thapar.Marketing.place.Marketing_Project.dtos.response;

import Thapar.Marketing.place.Marketing_Project.enums.Category;
import Thapar.Marketing.place.Marketing_Project.enums.ProductStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ProductResponse {

    private Long id;
    private String title;
    private String description;
    private Double price;
    private Category category;
    private ProductStatus status;
    private String imageUrl;
    private String rejectionReason;
    private Integer reportCount;

    // seller info
    private Long sellerId;
    private String sellerName;

    // meeting point (auto from seller's hostel)
    private String meetingHostel;
    private String meetingRoom;

    private LocalDateTime createdAt;
}