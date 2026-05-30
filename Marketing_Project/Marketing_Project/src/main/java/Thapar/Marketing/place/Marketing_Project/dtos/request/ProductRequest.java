package Thapar.Marketing.place.Marketing_Project.dtos.request;

import Thapar.Marketing.place.Marketing_Project.enums.Category;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ProductRequest {
    @NotNull(message = "Name is Required")
    private String title;
    @NotNull(message="Description is required")
   private  String description;

   private String imageUrl;

   @NotNull(message="mention the price")
   @Min(value = 0,message="price cannot be negative")
   private Double price;

   @NotNull(message="category is required")
   private Category category;
}
