
import { Request, Response, NextFunction  } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
// Gunakan dynamic import
import crypto from 'crypto';


import RoomModel from '../../models/Room/models_room';
import { BookingModel } from '../../models/Booking/models_booking';
import { snap } from '../../config/midtransConfig'

import { PENDING_PAYMENT } from '../../utils/constant';
import { SessionModel } from '../../models/Booking/models_session';
import { TransactionModel } from '../../models/Transaction/models_transaksi';
import { ShortAvailableModel } from '../../models/ShortAvailable/models_ShortAvailable';

export class ShortAvailableController {


    static async getAvailableRooms(req: Request, res: Response) {

        try {
            const { checkIn, checkOut } = req.body;
    
            if (!checkIn || !checkOut) {
                return res.status(400).json({ message: "Tanggal check-in dan check-out diperlukan." });
            }
    
            // Konversi tanggal ke UTC
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
    
            if (checkInDate >= checkOutDate) {
                return res.status(400).json({ message: "Tanggal check-out harus lebih besar dari tanggal check-in." });
            }
    
            // Debug: Log input tanggal dalam UTC
            // console.log("CheckIn UTC:", checkInDate.toISOString());
            // console.log("CheckOut UTC:", checkOutDate.toISOString());
    
            // Fiks Booking { checkIn dan CheckOut} : { 12 PM & 15 PM }

            // Query untuk mencari unavailable rooms
            const unavailableRooms = await ShortAvailableModel.find({
                status: "PAID",
                $or: [
                    {
                        checkIn: { $lt: checkOutDate.toISOString() }, 
                        checkOut: { $gt: checkInDate.toISOString() }, 
                    },
                ],
            });
    
            // Debug: Log hasil query unavailableRooms
            // console.log("Unavailable Rooms:", unavailableRooms);
    
            // Hitung jumlah room yang sudah dipesan
            const roomUsageCount: Record<string, number> = {};

            unavailableRooms.forEach((transaction) => {
                transaction.products.forEach((product: { roomId: mongoose.Types.ObjectId | string; quantity: number }) => {
                    const roomId = product.roomId.toString();
                    roomUsageCount[roomId] = (roomUsageCount[roomId] || 0) + product.quantity;
                });
            });
    
            // Debug: Log hasil roomUsageCount
            // console.log("Room Usage Count:", roomUsageCount);
    
            // Ambil semua room dari database
            const allRooms = await RoomModel.find({ isDeleted: false });
    
            // Debug: Log semua room
            // console.log("All Rooms:", allRooms);
    
            // Filter room yang tersedia
            const availableRooms = allRooms
                .map((room) => {
                    
                    const usedCount = roomUsageCount[room._id.toString()] || 0;
                    const availableCount = room.available - usedCount;
    
                    return {
                        ...room.toObject(),
                        availableCount: availableCount > 0 ? availableCount : 0,
                    };
                })
                .filter((room) => room.availableCount > 0);
    
            // Debug: Log room yang tersedia
            // console.log("Available Rooms:", availableRooms);
    
            res.status(200).json({
                requestId: uuidv4(),
                data: availableRooms,
                message: `Successfully retrieved rooms. From Date: ${checkInDate.toISOString()} To: ${checkOutDate.toISOString()}`,
                success: true,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                requestId: uuidv4(),
                data: null,
                message: (error as Error).message,
                success: false,
            });
        }
    }
    
            



        static async getShortVila(req: Request, res: Response) {
            const { checkin, checkout } = req.query;
        
            try {
            // Validasi dan konversi parameter checkin dan checkout
            if (!checkin || !checkout) {
                return res.status(400).json({
                requestId: uuidv4(),
                data: null,
                message: "Check-in and check-out dates are required.",
                success: false,
                });
            }
        
            // Query ke MongoDB
            const data = await BookingModel.find({
                isDeleted: false,
                checkIn:  checkin ,
                checkOut:  checkout ,
            });
        
            res.status(200).json({
                requestId: uuidv4(),
                data: data,
                message: `Successfully get vila.`,
                success: true,
            });
            
            } catch (error) {
            res.status(500).json({
                requestId: uuidv4(),
                data: null,
                message: (error as Error).message,
                success: false,
            });
            }
        }
      
        static async addBookedRoomForAvailable(data: any, res: Response) {
            try {
              // Membuat instance baru dengan data dari parameter
              const newAvailable = new ShortAvailableModel({
                    transactionId: data.transactionId,
                    userId: data.userId, 
                    status: data.status,
                    checkIn: data.checkIn, 
                    checkOut: data.checkOut, 
                    products: data.products.map((products : { roomId: string; price: number, quantity:number, name:string}) => ({
                        roomId: products.roomId,
                        price: products.price,
                        quantity: products.quantity,
                        name: products.name
                  }))
                })      
              // Menyimpan data ke database
              const savedShort = await newAvailable.save();
        
              // // Mengirimkan respon sukses
            //   return {
            //     success: true,
            //     message: "Successfully added room.",
            //     data: {
            //         acknowledged: true,
            //         insertedId: savedShort._id,
            //     },
            // };

            } catch (error) {
              // Menangani kesalahan dan mengirimkan respon gagal
              // Lemparkan error untuk ditangani oleh fungsi pemanggil
              throw new Error((error as Error).message);
            }
          }

        static async getTransactionsById (req: Request, res: Response) {
 
            const { transaction_id } = req.params;
            const transaction = await TransactionModel.findOne({bookingId : transaction_id});
        
            if(!transaction) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Transaction not found'
                })
            }
        
            res.status(202).json({
                status: 'success',
                data: transaction
            })
        };
        


        
}