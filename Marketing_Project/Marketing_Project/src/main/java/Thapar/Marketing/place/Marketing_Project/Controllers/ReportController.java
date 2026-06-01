// package Thapar.Marketing.place.Marketing_Project.Controllers;

// import Thapar.Marketing.place.Marketing_Project.Entities.User;
// import Thapar.Marketing.place.Marketing_Project.Services.ReportService;
// import Thapar.Marketing.place.Marketing_Project.dtos.request.ReportRequest;
// import Thapar.Marketing.place.Marketing_Project.dtos.response.ReportResponse;
// import jakarta.validation.Valid;
// import lombok.RequiredArgsConstructor;
// import org.springframework.http.ResponseEntity;
// import org.springframework.security.access.prepost.PreAuthorize;
// import org.springframework.security.core.annotation.AuthenticationPrincipal;
// import org.springframework.web.bind.annotation.*;

// import java.util.List;

// @RestController
// @RequestMapping("/api/products")
// @RequiredArgsConstructor
// public class ReportController {

//     private final ReportService reportService;

//     // POST /api/products/{id}/report — any logged-in user
//     @PostMapping("/{id}/report")
//     public ResponseEntity<ReportResponse> reportProduct(
//             @PathVariable Long id,
//             @Valid @RequestBody ReportRequest request,
//             @AuthenticationPrincipal User user) {
//         return ResponseEntity.ok(
//                 reportService.reportProduct(id, request, user));
//     }

//     // GET /api/products/{id}/reports — admin only
//     @GetMapping("/{id}/reports")
//     @PreAuthorize("hasAuthority('ADMIN')")
//     public ResponseEntity<List<ReportResponse>> getReportsForProduct(
//             @PathVariable Long id) {
//         return ResponseEntity.ok(
//                 reportService.getReportsForProduct(id));
//     }
// }
