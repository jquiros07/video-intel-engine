import cv2

def compute_motion(prev_gray, current_frame):
    gray = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)

    if prev_gray is None:
        return gray, 0.0

    diff = cv2.absdiff(prev_gray, gray)
    motion_score = diff.mean()

    return gray, float(motion_score)