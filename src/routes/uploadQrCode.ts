import { autenticarToken } from "./Auth";
import { storage } from "../services/firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import multer from "multer";
import { MultipartFile } from "@fastify/multipart";
const upload = multer({ storage: multer.memoryStorage() });
import { z } from "zod";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import crypto from "crypto";

async function uploadFileAndGetURL(file: any): Promise<string> {
  const allowedMimeTypes = [
    "image/png",
    "image/jpeg",
    "application/pdf",
    "image/jpg"
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(
      "Invalid file type. Only PNG, JPEG, JPG and PDF are accepted."
    );
  }

  const randomFilename = crypto.randomUUID();
  const storageRef = ref(storage, `qrCodesClient/${randomFilename}`);

  try {
    await uploadBytes(storageRef, await file.toBuffer(), {
      contentType: file.mimetype
    });
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    throw error;
  }
}

export async function uploadQrCode(app: FastifyInstance) {
  app.register(import("@fastify/multipart"), {
    limits: {
      fileSize: 20971520 // 20MB
    }
  });
  app.withTypeProvider<ZodTypeProvider>().post(
    "/qrcodes/upload/:id",
    {
      preHandler: autenticarToken,
      schema: {
        preHandler: [
          // autenticarToken
          upload.single("profilePhoto")
        ],
        summary:
          "Edit User Profile Photo - Envia o profilePhoto atráves do MultPartForm",
        description: "Envia o profilePhoto atráves do MultPartForm",
        tags: ["User"],
        consumes: ["multipart/form-data"],
        params: z.object({
          id: z.string().uuid()
        }),
        headers: z.object({
          authorization: z.string().optional()
        }),
        response: {
          200: z.object({
            message: z.string()
          }),
          400: z.object({
            message: z.string()
          }),
          500: z.object({
            message: z.string()
          })
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      const file = (await (request as any).file()) as MultipartFile;

      if (!file) {
        return reply.status(400).send({ message: "File not found" });
      }

      let searchOrder = await prisma.order.findUnique({
        where: { id },
        select: {
          qrCode: {
            select: {
              link: true
            }
          }
        }
      });

      const imageQrCode = await uploadFileAndGetURL(file);

      if (!imageQrCode) {
        return reply.status(400).send({ message: "File not found" });
      }

      const createQrCode = await prisma.qrCode.create({
        data: { link: imageQrCode, orderId: id }
      });

      if (!createQrCode) {
        return reply.status(400).send({ message: "QR Code not found" });
      }

      return reply.status(200).send({ message: "File uploaded" });
    }
  );
}
