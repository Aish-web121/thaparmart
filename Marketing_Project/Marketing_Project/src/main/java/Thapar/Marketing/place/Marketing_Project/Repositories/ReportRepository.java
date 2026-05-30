package Thapar.Marketing.place.Marketing_Project.Repositories;

import Thapar.Marketing.place.Marketing_Project.Entities.Product;
import Thapar.Marketing.place.Marketing_Project.Entities.Report;
import Thapar.Marketing.place.Marketing_Project.Entities.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {

    // all reports for a specific product
    List<Report> findByProduct(Product product);

    // all unresolved reports — admin sees these
    List<Report> findByResolved(boolean resolved);

    // check if this user already reported this product
    boolean existsByReporterAndProduct(User reporter, Product product);

    // count reports for a product
    long countByProduct(Product product);
}