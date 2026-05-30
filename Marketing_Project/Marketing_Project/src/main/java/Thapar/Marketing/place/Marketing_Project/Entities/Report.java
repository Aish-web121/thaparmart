package Thapar.Marketing.place.Marketing_Project.Entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name="Report")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Report {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch=FetchType.LAZY)
    @JoinColumn(name="reporter_id",nullable = false)
    private User reporter;

    @ManyToOne(fetch=FetchType.LAZY)
    @JoinColumn(name="product_id",nullable = false)
    private Product product;

    @Column(nullable = false)
    private String reason;

    @Column(nullable = false)
    private boolean resolved = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime reportedAt;

    @PrePersist
    public void prePersist() {
        this.reportedAt = LocalDateTime.now();}



}
