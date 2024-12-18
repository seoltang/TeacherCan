import {
  createContext,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LottieRef, LottieRefCurrentProps } from 'lottie-react';
import {
  MAX_TIME,
  NO_TIME,
  HOUR_TO_SECONDS,
  MINUTE_TO_SECONDS,
  MAX_TIME_INPUT,
} from './countdown-provider.constants';

type CountdownState = {
  hours: number;
  minutes: number;
  seconds: number;
  setupTime: number;
  leftTime: number;
  isActive: boolean;
  isHourUsed: boolean;
  isMusicUsed: boolean;
  iframeRef: MutableRefObject<HTMLIFrameElement>;
  musicAnimationRef: LottieRef;
};

export const CountdownStateContext = createContext<CountdownState | null>(null);

type CountdownAction = {
  handleStart: () => void;
  handlePause: () => void;
  handleStop: () => void;
  handleReset: () => void;
  updateHours: (_hou: number, keepPreviousState?: boolean) => void;
  updateMinutes: (_min: number, keepPreviousState?: boolean) => void;
  updateSeconds: (_sec: number, keepPreviousState?: boolean) => void;
  setIsMusicUsed: (value: SetStateAction<boolean>) => void;
  toggleMusicPlay: (to: 'on' | 'off') => void;
  toggleHourUsed: () => void;
};

export const CountdownActionContext = createContext<CountdownAction | null>(
  null,
);

type Props = {
  children: ReactNode;
};

export default function CountdownProvider({ children }: Props) {
  const [leftTime, setLeftTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isHourUsed, setIsHourUsed] = useState(false);
  const [isMusicUsed, setIsMusicUsed] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const setupTimeRef = useRef<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const musicAnimationRef = useRef<LottieRefCurrentProps | null>(null);

  const hours = Math.floor(leftTime / HOUR_TO_SECONDS);
  const minutes = Math.floor(
    (leftTime - hours * HOUR_TO_SECONDS) / MINUTE_TO_SECONDS,
  );
  const seconds = Math.floor(leftTime % MINUTE_TO_SECONDS);

  const toggleHourUsed = () => {
    if (isHourUsed) setLeftTime((prev) => prev - hours * HOUR_TO_SECONDS);
    setIsHourUsed((prev) => !prev);
  };

  const toggleMusicPlay = (to: 'on' | 'off') => {
    const isToPlay = to === 'on';

    const postMessage = isToPlay ? 'playVideo' : 'pauseVideo';
    iframeRef.current.contentWindow.postMessage(
      `{"event":"command","func":"${postMessage}"}`,
      '*',
    );

    if (isToPlay) {
      musicAnimationRef.current.play();
    } else {
      musicAnimationRef.current.pause();
    }
  };

  const handleStart = useCallback(() => {
    if (leftTime < 1) {
      return;
    }

    if (!setupTimeRef.current) {
      setupTimeRef.current = leftTime;
    }

    setIsActive(true);
    if (isMusicUsed) toggleMusicPlay('on');

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setLeftTime((prevTime) => {
        if (prevTime <= NO_TIME) {
          clearInterval(timerRef.current!);
          return 0;
        }
        const newTime = prevTime - 1;
        return newTime;
      });
    }, 1000);
  }, [leftTime, isMusicUsed]);

  const handlePause = useCallback(() => {
    setIsActive(false);
    if (isMusicUsed) toggleMusicPlay('off');
    if (timerRef.current) clearInterval(timerRef.current);
  }, [isActive, isMusicUsed]);

  const handleStop = useCallback(() => {
    setIsActive(false);
    if (isMusicUsed) toggleMusicPlay('off');
    if (setupTimeRef.current) {
      setLeftTime(setupTimeRef.current);
      setupTimeRef.current = NO_TIME;
    }

    if (timerRef.current) clearInterval(timerRef.current);
  }, [isMusicUsed]);

  const handleReset = useCallback(() => {
    if (setupTimeRef.current) {
      setupTimeRef.current = NO_TIME;
    }

    setLeftTime(NO_TIME);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (leftTime === NO_TIME && isActive) {
      setIsActive(false);
      if (isMusicUsed) toggleMusicPlay('off');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [leftTime, isActive]);

  const updateHours = useCallback(
    (hou: number, keepPreviousState: boolean = false) => {
      let newHour = hou;
      if (hou > MAX_TIME_INPUT.HOUR) newHour = MAX_TIME_INPUT.HOUR;

      const newLeftTime =
        (keepPreviousState
          ? (hours + newHour) * HOUR_TO_SECONDS
          : newHour * HOUR_TO_SECONDS) +
        minutes * MINUTE_TO_SECONDS +
        seconds;

      if (newLeftTime < NO_TIME || newLeftTime > MAX_TIME) {
        return;
      }

      setLeftTime(newLeftTime);
    },
    [hours, minutes, seconds],
  );

  const updateMinutes = useCallback(
    (min: number, keepPreviousState: boolean = false) => {
      setLeftTime((prev) => {
        let newMinute = min;
        if (min > MAX_TIME_INPUT.MINUTE) newMinute = MAX_TIME_INPUT.MINUTE;

        // 이전 값을(prev)를 바탕으로 시, 분, 초 값 할당
        const newHours = Math.floor(prev / HOUR_TO_SECONDS);
        const newMinutes = Math.floor(
          (prev - newHours * HOUR_TO_SECONDS) / MINUTE_TO_SECONDS,
        );
        const newSeconds = Math.floor(prev % MINUTE_TO_SECONDS);

        const newLeftTime =
          newHours * HOUR_TO_SECONDS +
          (keepPreviousState
            ? (newMinutes + newMinute) * MINUTE_TO_SECONDS
            : newMinute * MINUTE_TO_SECONDS) +
          newSeconds;

        // 아래 조건인 경우엔 이전 값을 return
        if (newLeftTime < NO_TIME || newLeftTime > MAX_TIME) {
          return prev;
        }

        // 그렇지 않으면 새로운 남은 시간을 return 하여 상태 업데이트
        return newLeftTime;
      });
    },

    [],
  );

  const updateSeconds = useCallback(
    (sec: number, keepPreviousState: boolean = false) => {
      setLeftTime((prev) => {
        let newSecond = sec;
        if (sec > MAX_TIME_INPUT.SECOND) newSecond = MAX_TIME_INPUT.SECOND;

        const newHours = Math.floor(prev / HOUR_TO_SECONDS);
        const newMinutes = Math.floor(
          (prev - newHours * HOUR_TO_SECONDS) / MINUTE_TO_SECONDS,
        );
        const newSeconds = Math.floor(prev % MINUTE_TO_SECONDS);

        const newLeftTime =
          newHours * HOUR_TO_SECONDS +
          newMinutes * MINUTE_TO_SECONDS +
          (keepPreviousState ? newSeconds + newSecond : newSecond);

        if (newLeftTime < NO_TIME || newLeftTime > MAX_TIME) {
          return prev;
        }

        return newLeftTime;
      });
    },
    [],
  );

  const defaultCountdownStateValue = useMemo<CountdownState>(
    () => ({
      hours,
      minutes,
      seconds,
      setupTime: setupTimeRef.current,
      leftTime,
      isActive,
      isHourUsed,
      isMusicUsed,
      iframeRef,
      musicAnimationRef,
    }),
    [
      hours,
      minutes,
      seconds,
      setupTimeRef,
      leftTime,
      isActive,
      isHourUsed,
      isMusicUsed,
      iframeRef,
      musicAnimationRef,
    ],
  );

  const defaultCountdownActionValue = useMemo<CountdownAction>(
    () => ({
      updateHours,
      updateMinutes,
      updateSeconds,
      handleStart,
      handlePause,
      handleStop,
      handleReset,
      setIsMusicUsed,
      toggleMusicPlay,
      toggleHourUsed,
    }),
    [
      updateHours,
      updateMinutes,
      updateSeconds,
      handleStart,
      handlePause,
      handleStop,
      handleReset,
      setIsMusicUsed,
      toggleMusicPlay,
      toggleHourUsed,
    ],
  );

  return (
    <CountdownStateContext.Provider value={defaultCountdownStateValue}>
      <CountdownActionContext.Provider value={defaultCountdownActionValue}>
        {children}
      </CountdownActionContext.Provider>
    </CountdownStateContext.Provider>
  );
}
