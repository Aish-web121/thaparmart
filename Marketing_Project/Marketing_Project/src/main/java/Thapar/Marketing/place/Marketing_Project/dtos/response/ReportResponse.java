package Thapar.Marketing.place.Marketing_Project.dtos.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ReportResponse {
    private Long id;
    private Long productId;
    private String productTitle;
    private Long reporterId;
    private String reporterName;
    private String reason;
    private boolean resolved;
    private LocalDateTime reportedAt;
}