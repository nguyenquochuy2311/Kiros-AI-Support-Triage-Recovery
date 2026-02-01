
import { Router } from 'express';
import { createTicket, getTickets, getTicket, resolveTicket } from '../controllers/ticketController';

const router = Router();

router.post('/', createTicket);
router.get('/', getTickets);
router.get('/:id', getTicket);
router.patch('/:id', resolveTicket);

export default router;
