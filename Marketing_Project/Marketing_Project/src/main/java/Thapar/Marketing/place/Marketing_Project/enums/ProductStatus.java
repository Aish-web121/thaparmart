package Thapar.Marketing.place.Marketing_Project.enums;

public enum ProductStatus {
    PENDING_REVIEW,   // just created waiting for admin approval
    AVAILABLE,        // approved, visible to buyers
    REJECTED,         // admin rejected it
    SOLD,             // seller marked it sold
    ARCHIVED //archived by seller
}
