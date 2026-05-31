package Thapar.Marketing.place.Marketing_Project.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

@Configuration
@EnableAsync
public class AsyncConfig {
    // Enables @Async on EmailService so SMTP does not block HTTP responses
}
