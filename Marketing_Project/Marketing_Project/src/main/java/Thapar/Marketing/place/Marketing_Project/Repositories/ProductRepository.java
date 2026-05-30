package Thapar.Marketing.place.Marketing_Project.Repositories;

import Thapar.Marketing.place.Marketing_Project.Entities.Product;
import Thapar.Marketing.place.Marketing_Project.Entities.User;
import Thapar.Marketing.place.Marketing_Project.enums.Category;
import Thapar.Marketing.place.Marketing_Project.enums.ProductStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProductRepository extends
        JpaRepository<Product, Long>,
        JpaSpecificationExecutor<Product> {   // needed for search filters

    // all available products
    List<Product> findByStatus(ProductStatus status);

    // seller's own listings
    List<Product> findBySeller(User seller);

    // admin — pending review queue
    List<Product> findByStatusOrderByCreatedAtAsc(ProductStatus status);

    // search by title or description (case insensitive)
    @Query("SELECT p FROM Product p WHERE p.status = 'AVAILABLE' AND " +
            "(LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(p.description) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Product> searchByQuery(@Param("query") String query);

    // auto-hide products with too many reports
    List<Product> findByReportCountGreaterThanEqual(Integer count);

    // products by category
    List<Product> findByStatusAndCategory(ProductStatus status, Category category);
}