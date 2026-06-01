package Thapar.Marketing.place.Marketing_Project.Controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LoaderVerifyController {

    @GetMapping("/loaderio-3b63abb42198be912c7b9d64d2350213")
    public ResponseEntity<String> loaderVerify() {
        return ResponseEntity.ok("loaderio-3b63abb42198be912c7b9d64d2350213");
    }
}
