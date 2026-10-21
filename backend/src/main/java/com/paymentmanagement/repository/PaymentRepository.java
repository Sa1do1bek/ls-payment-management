package com.paymentmanagement.repository;

import com.paymentmanagement.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    boolean existsByStudent_Id(Long studentId);
}
