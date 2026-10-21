package com.paymentmanagement.service;

import com.paymentmanagement.dto.request.StudentRequest;
import com.paymentmanagement.dto.response.StudentResponse;
import com.paymentmanagement.entity.Student;
import com.paymentmanagement.exception.StudentDeletionConflictException;
import com.paymentmanagement.exception.StudentNotFoundException;
import com.paymentmanagement.repository.PaymentRepository;
import com.paymentmanagement.repository.StudentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentServiceTest {

    @Mock
    private StudentRepository students;

    @Mock
    private PaymentRepository payments;

    @InjectMocks
    private StudentService service;

    private final StudentRequest request = new StudentRequest("Ali Valiyev", "+998901234567", "English B2", 800000L);

    @Test
    void createsStudentAndReturnsSavedFields() {
        when(students.save(any(Student.class))).thenAnswer(invocation -> {
            Student student = invocation.getArgument(0);
            ReflectionTestUtils.setField(student, "id", 7L);
            return student;
        });

        StudentResponse result = service.create(request);

        assertEquals(new StudentResponse(7L, "Ali Valiyev", "+998901234567", "English B2", 800000L), result);
    }

    @Test
    void findsExistingStudent() {
        when(students.findById(7L)).thenReturn(Optional.of(student(7L)));

        assertEquals(7L, service.get(7L).id());
    }

    @Test
    void missingStudentThrowsNotFound() {
        when(students.findById(999L)).thenReturn(Optional.empty());

        assertThrows(StudentNotFoundException.class, () -> service.get(999L));
    }

    @Test
    void listsStudentsInIdOrder() {
        when(students.findAll(Sort.by("id"))).thenReturn(List.of(student(2L), student(4L)));

        assertEquals(List.of(2L, 4L), service.list().stream().map(StudentResponse::id).toList());
        verify(students).findAll(Sort.by("id"));
    }

    @Test
    void updatesAllEditableFields() {
        Student existing = student(7L);
        when(students.findById(7L)).thenReturn(Optional.of(existing));
        StudentRequest replacement = new StudentRequest("Nodira Karimova", "90 123 45 67", "Math", 900000L);

        StudentResponse result = service.update(7L, replacement);

        assertEquals(new StudentResponse(7L, "Nodira Karimova", "90 123 45 67", "Math", 900000L), result);
        assertEquals("Nodira Karimova", existing.getName());
    }

    @Test
    void deletesStudentWithoutPayments() {
        Student existing = student(7L);
        when(students.findById(7L)).thenReturn(Optional.of(existing));
        when(payments.existsByStudent_Id(7L)).thenReturn(false);

        service.delete(7L);

        verify(students).delete(existing);
        verify(students).flush();
    }

    @Test
    void rejectsDeletionWhenPaymentsExist() {
        when(students.findById(7L)).thenReturn(Optional.of(student(7L)));
        when(payments.existsByStudent_Id(7L)).thenReturn(true);

        assertThrows(StudentDeletionConflictException.class, () -> service.delete(7L));
        verify(students, never()).delete(any(Student.class));
    }

    @Test
    void databaseRejectionDuringDeleteIsConflict() {
        Student existing = student(7L);
        when(students.findById(7L)).thenReturn(Optional.of(existing));
        doThrow(new DataIntegrityViolationException("foreign key details")).when(students).flush();

        assertThrows(StudentDeletionConflictException.class, () -> service.delete(7L));
    }

    private Student student(long id) {
        Student student = new Student("Ali Valiyev", "+998901234567", "English B2", 800000L);
        ReflectionTestUtils.setField(student, "id", id);
        return student;
    }
}
