import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { spacing } from '@/constants/theme';
import { CoverImageUploader } from '@/components/events/CoverImageUploader';
import { AdditionalImagesUploader } from '@/components/events/AdditionalImagesUploader';
import { CreateEventForm } from '@/components/events/CreateEventForm';
import { LocationPickerModal } from '@/components/events/LocationPickerModal';

type Props = {
    onValidate: (valid: boolean) => void;
    scrollViewRef?: React.RefObject<ScrollView>;
    onInputFocus?: (key: string) => void;
    onInputRef?: (key: string) => (node: any) => void;
};

export const Step1Content = ({ onValidate, scrollViewRef, onInputFocus, onInputRef }: Props) => {
    const [locationModalVisible, setLocationModalVisible] = useState(false);

    return (
        <>
            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <CoverImageUploader />
                <AdditionalImagesUploader />
                <CreateEventForm
                    onOpenLocation={() => setLocationModalVisible(true)}
                    onValidate={onValidate}
                    onInputFocus={onInputFocus}
                    onInputRef={onInputRef}
                />
            </ScrollView>

            <LocationPickerModal
                visible={locationModalVisible}
                onClose={() => setLocationModalVisible(false)}
            />
        </>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: spacing.md,
        paddingBottom: spacing.xl * 3,
    },
});
