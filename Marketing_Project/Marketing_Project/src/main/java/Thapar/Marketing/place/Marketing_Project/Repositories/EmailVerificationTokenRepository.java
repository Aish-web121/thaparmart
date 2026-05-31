package Thapar.Marketing.place.Marketing_Project.Repositories;

import Thapar.Marketing.place.Marketing_Project.Entities.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    // Get the latest token for this email
    Optional<EmailVerificationToken> findTopByEmailOrderByCreatedAtDesc(String email);

    // Delete all old tokens before issuing a new one
    @Modifying
    @Query("DELETE FROM EmailVerificationToken t WHERE t.email = :email")
    void deleteAllByEmail(String email);
}
