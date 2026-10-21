package com.paymentmanagement.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Positive
    @Column(nullable = false)
    private long amount;

    @NotNull
    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    protected Payment() {
    }

    public Payment(Student student, long amount, LocalDate paymentDate) {
        this.student = student;
        this.amount = amount;
        this.paymentDate = paymentDate;
    }

    public Long getId() {
        return id;
    }

    public Student getStudent() {
        return student;
    }

    public long getAmount() {
        return amount;
    }

    public LocalDate getPaymentDate() {
        return paymentDate;
    }
}
