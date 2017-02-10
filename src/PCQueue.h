#pragma once

#include <condition_variable>
#include <deque>
#include <mutex>

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
    }
private:
    std::mutex mu;
    std::condition_variable cond;
    std::deque<Data> buffer_;
};