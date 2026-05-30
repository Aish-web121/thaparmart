package Thapar.Marketing.place.Marketing_Project.filter;

import Thapar.Marketing.place.Marketing_Project.Entities.Product;
import Thapar.Marketing.place.Marketing_Project.enums.Category;
import Thapar.Marketing.place.Marketing_Project.enums.ProductStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class ProductSpecification {

    // builds a dynamic query based on whichever filters are provided
    public static Specification<Product> filter(
            String query,
            Category category,
            Double minPrice,
            Double maxPrice) {

        return (root, criteriaQuery, cb) -> {

            List<Predicate> predicates = new ArrayList<>();

            // always only show AVAILABLE products in search
            predicates.add(cb.equal(root.get("status"), ProductStatus.AVAILABLE));

            // text search in title + description
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), pattern),
                        cb.like(cb.lower(root.get("description")), pattern)
                ));
            }

            // category filter
            if (category != null) {
                predicates.add(cb.equal(root.get("category"), category));
            }

            // price range filter
            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("price"), minPrice));
            }
            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("price"), maxPrice));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}