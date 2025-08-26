"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";

interface ProcessedDocument {
  id: string;
  fileName: string;
  status: "processing" | "completed" | "error";
  result?: any;
  cost: number;
  timestamp: Date;
}

export default function DocumentProcessor() {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [currentProcess, setCurrentProcess] = useState<string>("");
  const [totalCost, setTotalCost] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  // Load from session storage
  useEffect(() => {
    const saved = sessionStorage.getItem("processedDocuments");
    if (saved) {
      const parsed = JSON.parse(saved);
      setDocuments(
        parsed.map((doc: any) => ({
          ...doc,
          timestamp: new Date(doc.timestamp),
        }))
      );
    }
  }, []);

  // Add to total cost when new documents are added
  useEffect(() => {
    const saved = sessionStorage.getItem("processedDocuments");
    if (saved) {
      const parsed = JSON.parse(saved);
      const savedTotalCost = parsed.reduce(
        (sum: number, doc: any) => sum + doc.cost,
        0
      );
      setTotalCost(savedTotalCost);
    }
  }, []);

  // Save to session storage
  useEffect(() => {
    if (documents.length > 0) {
      sessionStorage.setItem("processedDocuments", JSON.stringify(documents));
    } else {
      sessionStorage.removeItem("processedDocuments");
    }
  }, [documents]);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    const docId = Date.now().toString();

    const newDoc: ProcessedDocument = {
      id: docId,
      fileName: file.name,
      status: "processing",
      cost: 0, // Will be updated with actual cost
      timestamp: new Date(),
    };

    setDocuments((prev) => [...prev, newDoc]);
    setCurrentProcess("Extracting text from document...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResult.text) {
        setCurrentProcess("AI analyzing document structure...");

        const aiResponse = await fetch("/api/code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: uploadResult.text,
            conversationHistory: [],
          }),
        });

        const aiResult = await aiResponse.json();

        if (aiResult.success) {
          setCurrentProcess("Saving to session storage...");

          const actualCost =
            Math.round((aiResult.tokenUsage?.cost || 0.002) * 1000000) /
            1000000; // round to 6 decimal places

          setDocuments((prev) =>
            prev.map((doc) =>
              doc.id === docId
                ? {
                    ...doc,
                    status: "completed",
                    result: aiResult.message,
                    cost: actualCost,
                  }
                : doc
            )
          );

          setTotalCost(
            (prev) => Math.round((prev + actualCost) * 1000000) / 1000000
          );
        }
      } else {
        throw new Error(uploadResult.error || "Failed to extract text");
      }
    } catch (error) {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === docId ? { ...doc, status: "error" } : doc
        )
      );
    } finally {
      setCurrentProcess("");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + " " + formatTime(date);
  };

  const deleteDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
  };

  const getDocumentData = (result: string) => {
    try {
      const data = JSON.parse(result);
      return {
        documentType: data.documentType,
        confirmedPacket: data.confirmedPacket,
      };
    } catch {
      return null;
    }
  };

  const getPacketAnalysis = (result: string) => {
    try {
      const data = JSON.parse(result);
      if (data.documentType === "Not RDL") return null;

      const evidence = data.evidence || [];

      const requiredDocs = [
        { name: "DD 214", patterns: ["dd 214", "dd214", "discharge"] },
        {
          name: "VA Form 21-526EZ",
          patterns: ["21-526", "21526", "claim form"],
        },
        {
          name: "C&P Exam",
          patterns: ["c&p", "dbq", "compensation", "pension exam"],
        },
        {
          name: "STR",
          patterns: [
            "str",
            "service treatment",
            "medical records",
            "treatment records",
          ],
        },
        {
          name: "VA Form 21-0781",
          patterns: ["21-0781", "210781", "statement in support"],
        },
      ];

      const present: string[] = [];
      const missing: string[] = [];

      requiredDocs.forEach((doc) => {
        const found = evidence.some((item: string) => {
          const itemLower = item.toLowerCase();
          return doc.patterns.some((pattern) => itemLower.includes(pattern));
        });

        if (found) {
          present.push(doc.name);
        } else {
          missing.push(doc.name);
        }
      });

      return { present, missing, isComplete: missing.length === 0, evidence };
    } catch (e) {
      console.error("Error parsing packet analysis:", e);
      return null;
    }
  };

  const getSummary = (result: string) => {
    try {
      const data = JSON.parse(result);
      if (data.documentType === "Not RDL")
        return "Not a Rating Decision Letter";

      const conditions = data.claim?.conditions || [];
      const grantedCount = conditions.filter(
        (c: any) => c.adjudication === "Granted"
      ).length;
      const totalConditions = conditions.length;

      const veteranName = data.client?.name ? `${data.client.name} • ` : "";
      const branch = data.client?.branch || "Unknown";

      return `${veteranName}${grantedCount}/${totalConditions} conditions granted • ${branch} veteran`;
    } catch {
      return "Processing completed";
    }
  };

  const getDetailedView = (result: string) => {
    try {
      const data = JSON.parse(result);
      if (data.documentType === "Not RDL") {
        return (
          <div className="text-gray-600">
            This document is not a VA Rating Decision Letter.
          </div>
        );
      }

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-900">Veteran Info</h4>
              <p>Name: {data.client?.name || "N/A"}</p>
              <p>Branch: {data.client?.branch || "N/A"}</p>
              <p>
                Service: {data.client?.serviceStart} - {data.client?.serviceEnd}
              </p>
              <p>Era: {data.client?.era || "N/A"}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Claim Status</h4>
              <p>Received: {data.claim?.receivedDate || "N/A"}</p>
              <p>Packet: {data.confirmedPacket ? "Complete" : "Incomplete"}</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">
              Conditions ({data.claim?.conditions?.length || 0})
            </h4>
            <div className="space-y-2">
              {data.claim?.conditions?.map((condition: any, idx: number) => (
                <div key={idx} className="p-3 bg-gray-50 rounded">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{condition.name}</span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        condition.adjudication === "Granted"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {condition.adjudication}{" "}
                      {condition.evaluationPercent
                        ? `(${condition.evaluationPercent}%)`
                        : ""}
                    </span>
                  </div>
                  {condition.effectiveDate && (
                    <p className="text-sm text-gray-600">
                      Effective: {condition.effectiveDate}
                    </p>
                  )}
                </div>
              )) || <p className="text-gray-500">No conditions found</p>}
            </div>
          </div>
        </div>
      );
    } catch {
      return (
        <pre className="text-xs text-gray-700 whitespace-pre-wrap">
          {result}
        </pre>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          VA Document Processor
        </h1>
        <p className="text-sm text-gray-600 mt-1">Powered by AWS Nova AI</p>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Upload and Cost */}
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <input {...getInputProps()} />

                <p className="text-lg font-medium text-gray-700 mb-2">
                  {isDragActive
                    ? "Drop PDF here"
                    : "Drag & drop PDF or click to browse"}
                </p>
                <p className="text-sm text-gray-500">
                  Only PDF files are supported
                </p>
              </div>
            </div>

            {/* Current Process */}
            {currentProcess && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-blue-800 font-medium">
                    {currentProcess}
                  </span>
                </div>
              </div>
            )}

            {/* Cost Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Cost Summary</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {documents.length}
                  </div>
                  <div className="text-sm text-gray-600">
                    Documents Processed
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    ${totalCost.toFixed(6)}
                  </div>
                  <div className="text-sm text-gray-600">Total Cost</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Documents List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Processed Documents</h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-auto">
              {documents.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No documents processed yet</p>
                </div>
              ) : (
                documents
                  .slice()
                  .reverse()
                  .map((doc) => {
                    const docData = doc.result
                      ? getDocumentData(doc.result)
                      : null;
                    const analysis = doc.result
                      ? getPacketAnalysis(doc.result)
                      : null;
                    const isNotRDL = docData?.documentType === "Not RDL";
                    const isClickable = doc.status === "completed" && !isNotRDL;

                    let cardBgClass = "";
                    if (doc.status === "completed") {
                      if (isNotRDL) {
                        cardBgClass = "bg-gray-100";
                      } else if (analysis?.isComplete) {
                        cardBgClass = "bg-green-50";
                      } else {
                        cardBgClass = "bg-red-50";
                      }
                    } else if (doc.status === "processing") {
                      cardBgClass = "bg-blue-50";
                    }

                    return (
                      <div
                        key={doc.id}
                        className={`p-6 ${cardBgClass} relative`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDocument(doc.id);
                          }}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-lg font-bold w-6 h-6 flex items-center justify-center"
                          title="Delete document"
                        >
                          ×
                        </button>
                        <div className="flex items-center justify-between">
                          <div
                            className={`flex-1 -m-2 p-2 rounded pr-8 ${
                              isClickable
                                ? "cursor-pointer hover:bg-white hover:bg-opacity-50"
                                : "cursor-not-allowed opacity-60"
                            }`}
                            onClick={() =>
                              isClickable &&
                              window.open(`/document/${doc.id}`, "_blank")
                            }
                          >
                            <h3 className="font-medium text-gray-900">
                              {doc.fileName}
                            </h3>
                            <p className="text-sm text-gray-500">
                              Uploaded: {formatDate(doc.timestamp)}
                            </p>
                            {doc.result && doc.status === "completed" && (
                              <div className="mt-1">
                                <p className="text-sm text-blue-600">
                                  {getSummary(doc.result)}
                                </p>
                                {(() => {
                                  const analysis = getPacketAnalysis(
                                    doc.result
                                  );
                                  if (!analysis) return null;

                                  return (
                                    <div className="mt-2 text-xs">
                                      {analysis.present.length > 0 && (
                                        <div className="mb-1">
                                          <span className="text-green-600">
                                            {analysis.present.join(", ")}
                                          </span>
                                        </div>
                                      )}
                                      {analysis.missing.length > 0 && (
                                        <div>
                                          <span className="font-medium text-red-700">
                                            Missing:{" "}
                                          </span>
                                          <span className="text-red-600">
                                            {analysis.missing.join(", ")}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm font-medium text-gray-600">
                              ${doc.cost.toFixed(6)}
                            </span>
                            {doc.status === "completed" ? (
                              <span
                                className={`text-xs font-medium ${
                                  isNotRDL ? "text-gray-600" : "text-green-700"
                                }`}
                              >
                                {isNotRDL ? "unable to view" : "ready to view"}
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  doc.status === "error"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {doc.status}
                              </span>
                            )}

                            {doc.result && (
                              <span className="text-gray-400 mr-2">→</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
