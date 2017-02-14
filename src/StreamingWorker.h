#pragma once

#include "PCQueue.h"
#include "Message.h"
#include "nan.h"


class StreamingWorker : public Nan::AsyncProgressWorker {
public:

    StreamingWorker(Nan::Callback *progress);

    ~StreamingWorker();

    void HandleProgressCallback(const char *data, size_t size);

    void close();

    PCQueue<Message> fromNode;

    void writeToNode(const Nan::AsyncProgressWorker::ExecutionProgress& progress, Message & msg);


protected:

    bool closed();

    Nan::Callback *progress;
    PCQueue<Message> toNode;
    bool input_closed;

private:

    void drainQueue();
};

