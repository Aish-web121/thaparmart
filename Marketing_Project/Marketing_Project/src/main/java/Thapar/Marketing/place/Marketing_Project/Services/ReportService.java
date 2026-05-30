package Thapar.Marketing.place.Marketing_Project.Services;

import Thapar.Marketing.place.Marketing_Project.Entities.Product;
import Thapar.Marketing.place.Marketing_Project.Entities.Report;
import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.Repositories.ProductRepository;
import Thapar.Marketing.place.Marketing_Project.Repositories.ReportRepository;
import Thapar.Marketing.place.Marketing_Project.dtos.request.ReportRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.response.ReportResponse;
import Thapar.Marketing.place.Marketing_Project.enums.ProductStatus;
import Thapar.Marketing.place.Marketing_Project.exceptions.ResourceNotFoundException;
import Thapar.Marketing.place.Marketing_Project.exceptions.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final ProductRepository productRepository;

    // ── how many reports before auto-hiding ───────────────────────
    private static final int AUTO_HIDE_THRESHOLD = 3;

    // ── Buyer reports a product ───────────────────────────────────
    public ReportResponse reportProduct(Long productId,
                                        ReportRequest request,
                                        User reporter) {

        // 1. find the product
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found with id: " + productId));

        // 2. seller cannot report their own product
        if (product.getSeller().getId().equals(reporter.getId())) {
            throw new UnauthorizedException(
                    "You cannot report your own listing");
        }

        // 3. prevent duplicate reports from same user
        if (reportRepository.existsByReporterAndProduct(reporter, product)) {
            throw new UnauthorizedException(
                    "You have already reported this listing");
        }

        // 4. save the report
        Report report = Report.builder()
                .reporter(reporter)
                .product(product)
                .reason(request.getReason())
                .resolved(false)
                .build();

        reportRepository.save(report);

        // 5. increment report count on product
        product.setReportCount(product.getReportCount() + 1);

        // 6. auto-hide if report count hits threshold
        if (product.getReportCount() >= AUTO_HIDE_THRESHOLD) {
            product.setStatus(ProductStatus.PENDING_REVIEW);
            // product disappears from public listing
            // admin will review it
        }

        productRepository.save(product);

        return mapToResponse(report);
    }

    // ── Get all reports for a product ─────────────────────────────
    public List<ReportResponse> getReportsForProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found with id: " + productId));

        return reportRepository.findByProduct(product)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ── Get all unresolved reports (admin) ────────────────────────
    public List<ReportResponse> getAllUnresolved() {
        return reportRepository.findByResolved(false)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ── Admin resolves a report ───────────────────────────────────
    public ReportResponse resolveReport(Long reportId) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Report not found with id: " + reportId));

        report.setResolved(true);
        reportRepository.save(report);
        return mapToResponse(report);
    }

    // ── Map to response ───────────────────────────────────────────
    private ReportResponse mapToResponse(Report report) {
        return ReportResponse.builder()
                .id(report.getId())
                .productId(report.getProduct().getId())
                .productTitle(report.getProduct().getTitle())
                .reporterId(report.getReporter().getId())
                .reporterName(report.getReporter().getName())
                .reason(report.getReason())
                .resolved(report.isResolved())
                .reportedAt(report.getReportedAt())
                .build();
    }
}