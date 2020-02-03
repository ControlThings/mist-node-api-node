/**
 * Copyright (C) 2020, ControlThings Oy Ab
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * @license Apache-2.0
 */
#pragma once

#include <condition_variable>
#include <deque>
#include <mutex>

#include <iostream>

template<typename Data>
class PCQueue {
public:

    void write(Data data) {
        while (true) {
            std::unique_lock<std::mutex> locker(mu);
            buffer_.push_back(data);
            locker.unlock();
            cond.notify_all();
            return;
        }
    }

    Data read() {
        while (true) {
            std::unique_lock<std::mutex> locker(mu);
            cond.wait(locker, [this]() {
                return buffer_.size() > 0;
            });
            Data back = buffer_.front();
            buffer_.pop_front();
            locker.unlock();
            cond.notify_all();
            return back;
        }
    }

    void readAll(std::deque<Data> & target) {
        std::unique_lock<std::mutex> locker(mu);
        std::copy(buffer_.begin(), buffer_.end(), std::back_inserter(target));
        buffer_.clear();
        locker.unlock();
    }

    PCQueue() {
        //std::cout << "PCQueue is created\n";
    }
    
    ~PCQueue() {
        //std::cout << "PCQueue is destroyed\n";
    }
private:
    std::mutex mu;
    std::condition_variable cond;
    std::deque<Data> buffer_;
};