package com.paymentmanagement.service;

import com.paymentmanagement.dto.request.StudentRequest;
import com.paymentmanagement.dto.response.StudentResponse;
import com.paymentmanagement.entity.Student;
import com.paymentmanagement.exception.StudentDeletionConflictException;
import com.paymentmanagement.exception.StudentNotFoundException;
import com.paymentmanagement.repository.PaymentRepository;
import com.paymentmanagement.repository.StudentRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class StudentService {

    private final StudentRepository students;
    private final PaymentRepository payments;

    public StudentService(StudentRepository students, PaymentRepository payments) {
        this.students = students;
        this.payments = payments;
    }

    @Transactional
    public StudentResponse create(StudentRequest request) {
        Student student = new Student(request.name(), request.phone(), request.groupName(), request.monthlyFee());
        return toResponse(students.save(student));
    }

    public List<StudentResponse> list() {
        return students.findAll(Sort.by("id")).stream().map(this::toResponse).toList();
    }

    public StudentResponse get(long id) {
        return toResponse(findStudent(id));
    }

    @Transactional
    public StudentResponse update(long id, StudentRequest request) {
        Student student = findStudent(id);
        student.updateDetails(request.name(), request.phone(), request.groupName(), request.monthlyFee());
        return toResponse(student);
    }

    @Transactional
    public void delete(long id) {
        Student student = findStudent(id);
        if (payments.existsByStudent_Id(id)) {
            throw new StudentDeletionConflictException(id);
        }
        try {
            students.delete(student);
            students.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new StudentDeletionConflictException(id, exception);
        }
    }

    private Student findStudent(long id) {
        return students.findById(id).orElseThrow(() -> new StudentNotFoundException(id));
    }

    private StudentResponse toResponse(Student student) {
        return new StudentResponse(student.getId(), student.getName(), student.getPhone(),
                student.getGroupName(), student.getMonthlyFee());
    }
}
