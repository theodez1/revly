declare module 'react-native-share' {
  export interface ShareOptions {
    url?: string;
    type?: string;
    title?: string;
    message?: string;
    subject?: string;
  }

  export interface ShareSingleOptions {
    social: Social;
    url?: string;
    stickerImage?: string;
    backgroundTopColor?: string;
    backgroundBottomColor?: string;
    attributionURL?: string;
  }

  export enum Social {
    FACEBOOK = 'facebook',
    INSTAGRAM_STORIES = 'instagram-stories',
    TWITTER = 'twitter',
    WHATSAPP = 'whatsapp',
  }

  class Share {
    static open(options: ShareOptions): Promise<any>;
    static shareSingle(options: ShareSingleOptions): Promise<any>;
    static Social: typeof Social;
  }

  export default Share;
}

