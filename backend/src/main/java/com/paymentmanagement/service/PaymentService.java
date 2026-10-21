package com.paymentmanagement.service;

import com.paymentmanagement.dto.request.CreatePaymentRequest;
import com.paymentmanagement.dto.response.PaymentResponse;
import com.paymentmanagement.entity.Payment;
import com.paymentmanagement.entity.Student;
import com.paymentmanagement.exception.StudentNotFoundException;
import com.paymentmanagement.repository.PaymentRepository;
import com.paymentmanagement.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class PaymentService {

    private final StudentRepository students;
    private final PaymentRepository payments;

    public PaymentService(StudentRepository students, PaymentRepository payments) {
        this.students = students;
        this.payments = payments;
    }

    @Transactional
    public PaymentResponse create(CreatePaymentRequest request) {
        Student student = students.findById(request.studentId())
                .orElseThrow(() -> new StudentNotFoundException(request.studentId()));
        Payment payment = new Payment(student, request.amount(), request.paymentDate());
        return toResponse(payments.save(payment));
    }

    public List<PaymentResponse> history(long studentId) {
        if (!students.existsById(studentId)) {
            throw new StudentNotFoundException(studentId);
        }
        return payments.findByStudent_IdOrderByPaymentDateDescIdDesc(studentId)
                .stream().map(this::toResponse).toList();
    }

    private PaymentResponse toResponse(Payment payment) {
        return new PaymentResponse(payment.getId(), payment.getStudent().getId(),
                payment.getAmount(), payment.getPaymentDate());
    }
}
