package com.paymentmanagement.service;

import com.paymentmanagement.dto.request.CreatePaymentRequest;
import com.paymentmanagement.dto.response.PaymentResponse;
import com.paymentmanagement.entity.Payment;
import com.paymentmanagement.entity.Student;
import com.paymentmanagement.exception.StudentNotFoundException;
import com.paymentmanagement.repository.PaymentRepository;
import com.paymentmanagement.repository.StudentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private StudentRepository students;

    @Mock
    private PaymentRepository payments;

    @InjectMocks
    private PaymentService service;

    private final LocalDate date = LocalDate.of(2026, 10, 21);

    @Test
    void recordsPaymentForExistingStudentWithoutChangingFee() {
        Student student = student(7L);
        when(students.findById(7L)).thenReturn(Optional.of(student));
        when(payments.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment payment = invocation.getArgument(0);
            assertSame(student, payment.getStudent());
            ReflectionTestUtils.setField(payment, "id", 11L);
            return payment;
        });

        PaymentResponse result = service.create(new CreatePaymentRequest(7L, 300000L, date));

        assertEquals(new PaymentResponse(11L, 7L, 300000L, date), result);
        assertEquals(800000L, student.getMonthlyFee());
    }

    @Test
    void rejectsPaymentForMissingStudent() {
        when(students.findById(999L)).thenReturn(Optional.empty());

        assertThrows(StudentNotFoundException.class,
                () -> service.create(new CreatePaymentRequest(999L, 300000L, date)));
        verify(payments, never()).save(any(Payment.class));
    }

    @Test
    void returnsSeparatePaymentsInRepositoryOrder() {
        Student student = student(7L);
        when(students.existsById(7L)).thenReturn(true);
        when(payments.findByStudent_IdOrderByPaymentDateDescIdDesc(7L)).thenReturn(List.of(
                payment(12L, student, 300000L, date),
                payment(11L, student, 200000L, LocalDate.of(2026, 10, 5))));

        List<PaymentResponse> result = service.history(7L);

        assertEquals(List.of(12L, 11L), result.stream().map(PaymentResponse::id).toList());
        assertEquals(List.of(300000L, 200000L), result.stream().map(PaymentResponse::amount).toList());
        verify(payments).findByStudent_IdOrderByPaymentDateDescIdDesc(7L);
    }

    @Test
    void returnsEmptyHistoryForExistingStudent() {
        when(students.existsById(7L)).thenReturn(true);
        when(payments.findByStudent_IdOrderByPaymentDateDescIdDesc(7L)).thenReturn(List.of());

        assertEquals(List.of(), service.history(7L));
    }

    @Test
    void missingStudentHistoryThrowsNotFound() {
        when(students.existsById(999L)).thenReturn(false);

        assertThrows(StudentNotFoundException.class, () -> service.history(999L));
        verify(payments, never()).findByStudent_IdOrderByPaymentDateDescIdDesc(999L);
    }

    @Test
    void repeatedSameDayPaymentsRemainIndependent() {
        when(students.findById(7L)).thenReturn(Optional.of(student(7L)));
        AtomicLong nextId = new AtomicLong(11L);
        when(payments.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment payment = invocation.getArgument(0);
            ReflectionTestUtils.setField(payment, "id", nextId.getAndIncrement());
            return payment;
        });
        CreatePaymentRequest request = new CreatePaymentRequest(7L, 100000L, date);

        PaymentResponse first = service.create(request);
        PaymentResponse second = service.create(request);

        assertEquals(List.of(11L, 12L), List.of(first.id(), second.id()));
        verify(payments, times(2)).save(any(Payment.class));
    }

    private Student student(long id) {
        Student student = new Student("Ali Valiyev", "+998901234567", "English B2", 800000L);
        ReflectionTestUtils.setField(student, "id", id);
        return student;
    }

    private Payment payment(long id, Student student, long amount, LocalDate date) {
        Payment payment = new Payment(student, amount, date);
        ReflectionTestUtils.setField(payment, "id", id);
        return payment;
    }
}
