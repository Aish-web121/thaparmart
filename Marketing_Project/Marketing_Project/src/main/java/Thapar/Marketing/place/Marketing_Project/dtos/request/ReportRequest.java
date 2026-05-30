package Thapar.Marketing.place.Marketing_Project.dtos.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReportRequest {

    @NotBlank(message="Reason is Required")
    private String reason;

}
