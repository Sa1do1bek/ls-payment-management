package com.paymentmanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "students")
public class Student {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String name;

    @NotBlank
    @Size(max = 30)
    @Column(nullable = false, length = 30)
    private String phone;

    @NotBlank
    @Size(max = 100)
    @Column(name = "group_name", nullable = false, length = 100)
    private String groupName;

    @Positive
    @Column(name = "monthly_fee", nullable = false)
    private long monthlyFee;

    protected Student() {
    }

    public Student(String name, String phone, String groupName, long monthlyFee) {
        this.name = name;
        this.phone = phone;
        this.groupName = groupName;
        this.monthlyFee = monthlyFee;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getPhone() {
        return phone;
    }

    public String getGroupName() {
        return groupName;
    }

    public long getMonthlyFee() {
        return monthlyFee;
    }
}
