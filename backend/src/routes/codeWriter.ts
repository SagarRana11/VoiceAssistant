import { Router } from 'express';
import controller from '../../CodeWriter/controller/task';

const router = Router();

router.post('/', controller);

export default router;
